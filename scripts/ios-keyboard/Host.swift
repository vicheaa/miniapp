import UIKit
import WebKit

// Isolated test host. This never replaces or signs the production Flutter app.
@main
class KeyboardApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = KeyboardHost()
        window?.makeKeyAndVisible()
        return true
    }
}

class KeyboardHost: UIViewController {
    var web: WKWebView!
    let status = UILabel()
    var sampler: Timer?
    var previousWebFrame: CGRect?
    var webFrameChanges = 0
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let web = web else { return }
        if let previous = previousWebFrame, previous != web.frame { webFrameChanges += 1 }
        previousWebFrame = web.frame
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        let configuration = WKWebViewConfiguration()
        let script = try! String(contentsOf: Bundle.main.url(forResource: "fixture", withExtension: "js")!, encoding: .utf8)
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.isInspectable = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        let toolbar = UIStackView()
        toolbar.axis = .horizontal
        toolbar.distribution = .fillEqually
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbar)
        for (title, selector) in [("Dismiss", #selector(dismissEditing)), ("Products", #selector(products)), ("Address", #selector(address))] {
            let button = UIButton(type: .system)
            button.setTitle(title, for: .normal)
            button.accessibilityIdentifier = "test-\(title)"
            button.addTarget(self, action: selector, for: .touchUpInside)
            toolbar.addArrangedSubview(button)
        }
        status.text = "Keyboard diagnostics"
        status.accessibilityIdentifier = "keyboard-diagnostics"
        status.font = .systemFont(ofSize: 10)
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        let bottom = ProcessInfo.processInfo.arguments.contains("--resize") ? view.keyboardLayoutGuide.topAnchor : view.safeAreaLayoutGuide.bottomAnchor
        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.heightAnchor.constraint(equalToConstant: 32),
            status.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            status.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            status.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            status.heightAnchor.constraint(equalToConstant: 16),
            web.topAnchor.constraint(equalTo: status.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: bottom),
        ])
        web.load(URLRequest(url: URL(string: "http://127.0.0.1:5176/#/cart")!))
        sampler = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.web.evaluateJavaScript("JSON.stringify(window.keyboardSnapshot ? keyboardSnapshot() : {})") { value, _ in
                if let value = value as? String,
                   var snapshot = (try? JSONSerialization.jsonObject(with: Data(value.utf8))) as? [String: Any] {
                    snapshot["nativeFrameChanges"] = self.webFrameChanges
                    self.status.accessibilityValue = String(data: try! JSONSerialization.data(withJSONObject: snapshot), encoding: .utf8)
                }
            }
        }
    }
    @objc func dismissEditing() { web.endEditing(true) }
    @objc func products() { web.endEditing(true); web.evaluateJavaScript("location.hash='/products'") }
    @objc func address() { web.endEditing(true); web.evaluateJavaScript("location.hash='/cart/location'") }
}
