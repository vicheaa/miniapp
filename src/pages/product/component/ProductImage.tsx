import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { Product } from '../../../types/product';
import { mediaUrl, productName } from '../catalog';
import fallbackImage from '../../../../assets/images/OML_square_logo.png';

export default function ProductImage({ product, fallback }: { product: Product | null; fallback?: ReactNode }) {
  const { t, language } = useTranslation();
  const image = mediaUrl(product?.thumbnail?.file_url) ?? mediaUrl(product?.images?.find((file) => file.file_url)?.file_url);
  const [failedImage, setFailedImage] = useState<string>();
  return (
    <div className="product-image">
      {image && failedImage !== image ? (
        <img src={image} alt={product ? productName(product, language) : t('products.noImage')} loading="lazy" onError={() => setFailedImage(image)} />
      ) : (
        <div className="product-image-fallback" role="img" aria-label={t('products.noImage')}>
          {fallback ?? <img src={fallbackImage} alt="" />}
        </div>
      )}
    </div>
  );
}
