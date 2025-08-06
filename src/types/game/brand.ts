export interface Brand {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  logo: string;
  followed_by_current_user?: boolean;
  description?: string;
  createdAt: Date;
  follower_count?: number;
}
