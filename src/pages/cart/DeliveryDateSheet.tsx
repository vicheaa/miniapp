import { useMemo, useRef, useState } from 'react';
import BottomSheet from '../../components/ui/BottomSheet';
import { useTranslation } from '../../hooks/useTranslation';
import { clampDeliveryDate, deliveryIso, deliveryParts, daysInMonth, type DeliveryParts } from '../../utils/delivery';
import WheelPicker, { type WheelPickerHandle } from './WheelPicker';

const range = (from: number, count: number) => Array.from({ length: count }, (_, index) => ({ value: from + index, label: String(from + index) }));

export default function DeliveryDateSheet({ value, onClose, onSelect }: { value?: string | null; onClose: () => void; onSelect: (value: string) => void }) {
  const { t, language } = useTranslation();
  const [minimum] = useState(() => deliveryParts());
  const [parts, setParts] = useState(() => clampDeliveryDate(deliveryParts(value), minimum));
  const [wheelRevision] = useState(0);
  const day = useRef<WheelPickerHandle>(null);
  const month = useRef<WheelPickerHandle>(null);
  const year = useRef<WheelPickerHandle>(null);
  const change = (key: keyof DeliveryParts, value: number) => setParts((current) => clampDeliveryDate({ ...current, [key]: value }, minimum));
  const monthNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-GB', { month: 'short', timeZone: 'UTC' });
    return range(1, 12).map((option) => ({ ...option, label: formatter.format(new Date(Date.UTC(2020, option.value - 1, 15))) }));
  }, [language]);
  const firstMonth = parts.year === minimum.year ? minimum.month : 1;
  const firstDay = parts.year === minimum.year && parts.month === minimum.month ? minimum.day : 1;
  // const selected = deliveryIso(parts);
  // const isToday = selected === deliveryIso(minimum);
  function confirm() {
    const selectedParts = { year: year.current?.readValue() ?? parts.year, month: month.current?.readValue() ?? parts.month, day: day.current?.readValue() ?? parts.day };
    // Read the wheel positions directly so Done also commits a wheel still settling.
    onSelect(deliveryIso(clampDeliveryDate(selectedParts, deliveryParts())));
  }
  return <BottomSheet title={t('cart.deliveryDate')} onClose={onClose} className="checkout-date-sheet" swipeToClose>
    <div className="checkout-sheet-toolbar"><h2>{t('cart.deliveryDate')}</h2></div>
    {/* <div className="checkout-date-heading">
      <time dateTime={selected}>{new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Phnom_Penh' }).format(new Date(selected))}</time>
      <button type="button" aria-pressed={isToday} onClick={() => { setParts(deliveryParts()); setWheelRevision((current) => current + 1); }}>{t('checkout.today')}</button>
    </div> */}
    <div key={wheelRevision} className="checkout-wheels" role="group" aria-label={t('cart.deliveryDate')}>
      <div className="checkout-wheel-selection" aria-hidden="true" />
      <WheelPicker ref={day} label={t('checkout.day')} value={parts.day} minimumValue={firstDay} options={range(1, daysInMonth(parts.year, parts.month))} onChange={(value) => change('day', value)} />
      <WheelPicker ref={month} label={t('checkout.month')} value={parts.month} minimumValue={firstMonth} options={monthNames} onChange={(value) => change('month', value)} />
      <WheelPicker ref={year} label={t('checkout.year')} value={parts.year} minimumValue={minimum.year} options={range(minimum.year - 10, Math.max(minimum.year + 10, parts.year) - minimum.year + 11)} onChange={(value) => change('year', value)} />
    </div>
    <button type="button" className="cart-continue checkout-date-confirm" onClick={confirm}>{t('checkout.done')}</button>
  </BottomSheet>;
}
