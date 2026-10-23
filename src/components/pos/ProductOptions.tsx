import { useState } from 'react';
import { Coffee, Minus, Plus } from 'lucide-react';
import type { ExchangeRate, Product, ProductVariant } from '../../types/pos-terminal';
import { productImageUrl } from '../../services/api/pos-terminal';
import { convertPrice, money } from '../../utils/pos-pricing';
import TerminalDialog from './TerminalDialog';

function OptionImage({ image, fallback }: { image?: string | null; fallback?: string | null }) {
  const src = productImageUrl(image || fallback);
  const [failedSrc, setFailedSrc] = useState<string>();
  return src && src !== failedSrc ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : <Coffee aria-hidden="true" size={24} />;
}

export default function ProductOptions({ product, currency, rates, onAdd, onClose }: {
  product: Product; currency: string; rates: ExchangeRate[];
  onAdd: (product: Product, variant?: ProductVariant, quantity?: number, note?: string) => void; onClose: () => void;
}) {
  const variants = product.variants || [];
  const canSelect = (variant: ProductVariant) => variant.is_available && convertPrice(Number(variant.price), product.currency, currency, rates) !== null;
  const [variantId, setVariantId] = useState(() => variants.find(canSelect)?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const selected = variants.find((variant) => variant.id === variantId);
  const price = convertPrice(Number(selected?.price ?? product.price), product.currency, currency, rates);
  const names = [...new Set(variants.flatMap((variant) => Object.keys(variant.values)))];
  const groups = names.map((name) => {
    const values = [...new Set(variants.flatMap((variant) => variant.values[name] === undefined ? [] : [variant.values[name]]))];
    if (name.trim().toLowerCase() === 'sweetness') {
      values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return { name, values };
  });
  const chooseVariant = (name: string, value: string) => variants.find((variant) => canSelect(variant) && variant.values[name] === value
    && names.every((other) => other === name || variant.values[other] === selected?.values[other]))
    || variants.find((variant) => canSelect(variant) && variant.values[name] === value);

  return <TerminalDialog title={product.name} onClose={onClose} className="product-options-dialog" header={<div className="product-options-heading">
    <div className="product-options-photo"><OptionImage image={selected?.image} fallback={product.image} /></div>
    <div className="product-options-info"><h2 id="terminal-dialog-title">{product.name}</h2>
      {product.category?.name && <span className="product-options-category">{product.category.name}</span>}
      <strong className="product-options-price">{money(price, currency)}</strong>
    </div>
  </div>}>
    <div className="product-options-groups">{groups.map(({ name, values }) => <fieldset className="product-options-group" key={name}>
      <legend className="product-options-sr-only">{name}</legend>
      <div className="product-options-group-title" aria-hidden="true"><span>{name}</span><strong>{selected?.values[name] || 'Choose an option'}</strong></div>
      <div className="product-options-grid">{values.map((value) => {
        const candidate = chooseVariant(name, value);
        return <label key={value} className={`product-option-card ${selected?.values[name] === value ? 'selected' : ''} ${!candidate ? 'unavailable' : ''}`}>
          <input type="radio" name={`product-option-${name}`} value={value} checked={selected?.values[name] === value} disabled={!candidate} onChange={() => candidate && setVariantId(candidate.id)} />
          <span className="product-option-thumbnail"><OptionImage image={candidate?.image} fallback={product.image} /></span><span>{value}</span>
        </label>;
      })}</div>
    </fieldset>)}</div>
    {!groups.length && variants.length > 0 && <fieldset className="product-options-group"><legend>Product options</legend><div className="product-options-grid">{variants.map((variant) => <label key={variant.id} className={`product-option-card ${variantId === variant.id ? 'selected' : ''} ${!canSelect(variant) ? 'unavailable' : ''}`}>
      <input type="radio" name="product-variant" checked={variantId === variant.id} disabled={!canSelect(variant)} onChange={() => setVariantId(variant.id)} /><span>{variant.sku}</span>
    </label>)}</div></fieldset>}
    <div className="product-options-quantity"><span>Quantity</span><div className="product-options-quantity-row">
      <div className="product-options-stepper"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}><Minus size={16} /></button><output aria-label="Quantity" aria-live="polite">{quantity}</output><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => value + 1)}><Plus size={16} /></button></div>
      <span className="product-options-subtotal">Subtotal: <strong>{money(price === null ? null : price * quantity, currency)}</strong></span>
    </div></div>
    <label className="product-options-note">Item Instruction / Custom Note<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Less sugar, extra ice, no onion..." /></label>
    <footer className="product-options-footer"><button type="button" className="product-options-cancel" onClick={onClose}>Cancel</button><button type="button" className="product-options-add" disabled={price === null || (variants.length > 0 && (!selected || !canSelect(selected)))} onClick={() => {
      onAdd(product, selected, quantity, note.trim()); onClose();
    }}>Add to Order Cart</button></footer>
  </TerminalDialog>;
}
