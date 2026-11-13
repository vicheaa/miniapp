export interface LocationAddressDetails {
  province: string;
  district: string;
  commune: string;
  village: string;
}

export const emptyLocationAddressDetails = (): LocationAddressDetails => ({ province: '', district: '', commune: '', village: '' });
