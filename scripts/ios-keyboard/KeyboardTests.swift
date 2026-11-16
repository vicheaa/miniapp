import XCTest

final class KeyboardTests: XCTestCase {
    var resizingHost = false
    var initialNativeFrameChanges = 0
    func state(_ app: XCUIApplication) -> [String: Any] {
        let value = app.staticTexts["keyboard-diagnostics"].value as? String ?? "{}"
        return (try? JSONSerialization.jsonObject(with: Data(value.utf8))) as? [String: Any] ?? [:]
    }
    func wait(_ app: XCUIApplication, _ description: String, timeout: TimeInterval = 10, until condition: ([String: Any]) -> Bool) {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if condition(state(app)) { return }
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
        }
        XCTFail("\(description): \(state(app))")
    }
    func opened(_ app: XCUIApplication, input: XCUIElement) {
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "\(state(app))")
        wait(app, "keyboard detected") { $0["open"] as? String == "true" }
        Thread.sleep(forTimeInterval: 0.4)
        let snapshot = state(app)
        print("IOS OPEN \(snapshot)")
        XCTAssertEqual(snapshot["footerVisible"] as? Bool, false)
        XCTAssertGreaterThan(snapshot["editingFrames"] as? Int ?? 0, 0)
        XCTAssertEqual(snapshot["footerFlashFrames"] as? Int, 0, "Bottom actions must stay hidden from the first focus frame, including keyboard animation")
        XCTAssertEqual(snapshot["pageTop"] as? Double ?? 999, 0, accuracy: 2)
        if !resizingHost {
            XCTAssertEqual(snapshot["nativeFrameChanges"] as? Int, initialNativeFrameChanges, "The iOS native WebView must not resize during keyboard animation")
        }
        XCTAssertGreaterThanOrEqual(input.frame.minY, app.webViews.firstMatch.frame.minY)
        XCTAssertLessThanOrEqual(input.frame.maxY, app.keyboards.firstMatch.frame.minY + 1)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "keyboard-\(snapshot["route"] ?? "input")"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func closed(_ app: XCUIApplication) {
        app.buttons["test-Dismiss"].tap()
        wait(app, "keyboard recovery") { $0["open"] as? String == "false" && $0["footerVisible"] as? Bool == true }
        let snapshot = state(app)
        print("IOS CLOSED \(snapshot)")
        XCTAssertEqual(snapshot["footerVisible"] as? Bool, true)
        XCTAssertEqual(snapshot["pageTop"] as? Double ?? 999, 0, accuracy: 2)
        if !resizingHost {
            XCTAssertEqual(snapshot["nativeFrameChanges"] as? Int, initialNativeFrameChanges)
        }
        XCTAssertEqual(snapshot["scrollY"] as? Double ?? 999, 0, accuracy: 1)
        XCTAssertEqual(snapshot["pageHeight"] as? Double ?? 0, app.webViews.firstMatch.frame.height, accuracy: 2)
    }
    func exercise(resize: Bool) {
        continueAfterFailure = false
        let app = XCUIApplication()
        if resize { app.launchArguments = ["--resize"] }
        app.launch()
        wait(app, "checkout fixture", timeout: 30) { $0["ready"] as? Bool == true }
        resizingHost = resize
        initialNativeFrameChanges = state(app)["nativeFrameChanges"] as? Int ?? 0
        let fields = app.webViews.textFields
        let phone = fields.element(boundBy: 0)
        phone.tap()
        opened(app, input: phone)
        phone.typeText("012345678")
        closed(app)
        let customer = fields.element(boundBy: 1)
        for index in 0..<3 {
            customer.tap()
            opened(app, input: customer)
            customer.typeText(index == 0 ? "Sok Dara" : "x")
            closed(app)
        }
        XCTAssertEqual(phone.value as? String, "012345678")
        let customerValue = customer.value as? String ?? ""
        XCTAssertTrue(customerValue.contains("Sok Dara"))
        XCTAssertEqual(customerValue.count, 10) // Tap placement chooses the native caret position.
        app.buttons["test-Products"].tap()
        wait(app, "products") { $0["route"] as? String == "#/products" }
        let quantity = app.webViews.textFields.firstMatch
        XCTAssertTrue(quantity.waitForExistence(timeout: 10))
        quantity.tap()
        opened(app, input: quantity)
        closed(app)
        app.webViews.buttons["Search products"].tap()
        let search = app.webViews.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        opened(app, input: search)
        search.typeText("Vital")
        closed(app)
        XCTAssertEqual(search.value as? String, "Vital")
        app.buttons["test-Address"].tap()
        wait(app, "address") { $0["addressReady"] as? Bool == true }
        let address = app.webViews.textViews.firstMatch
        address.tap()
        opened(app, input: address)
        address.typeText("House 12")
        closed(app)
        XCTAssertTrue((address.value as? String ?? "").contains("House 12"))
        app.terminate()
    }
    func testResizingHost() { exercise(resize: true) }
    func testOverlayKeyboard() { exercise(resize: false) }
}
