export interface MediaFile {
  id?: string;
  original_name?: string;
  file_url?: string;
  attached_to?: string;
  attached_to_id?: string;
}

export interface Category {
  id: number;
  code: string;
  name_en: string;
  name_kh: string | null;
  thumbnail: MediaFile | null;
  images: MediaFile[];
  status: string;
  description: string | null;
  order_index: number | null;
  soft_deleted: boolean;
  deleted_at: string | null;
}
