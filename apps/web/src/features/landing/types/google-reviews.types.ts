export interface GoogleReviewOwnerResponse {
  text: string;
  date: string | null;
}

export interface GoogleReview {
  id: string;
  name: string;
  role: string;
  location: string;
  isoDate: string | null;
  quote: string;
  rating: number;
  likes: number;
  image: string;
  profileUrl: string | null;
  photos: string[];
  ownerResponse: GoogleReviewOwnerResponse | null;
}

export interface GoogleReviewsData {
  reviews: GoogleReview[];
  totalFetched?: number;
  averageRating: number;
  totalCount: number;
  placeName: string;
  lastUpdate: string;
}
