export interface IconographyItem {
  _id: string;
  name: string;
  emoji?: string;
  iconUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CreateIconPayload {
  name?: string;
  emoji?: string;
  icon?: File;
}

export interface UpdateIconPayload {
  name?: string;
  emoji?: string;
  icon?: File;
}
