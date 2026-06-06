import { create } from "zustand";
import { type MediaType } from "@prisma/client";

interface EditPostData {
  postId: number;
  content: string;
  commentsEnabled: boolean;
  medias: Array<{ id: number; url: string; type: MediaType }>;
}

interface EditCommunityPostModalProps {
  isOpen: boolean;
  post: EditPostData | null;
  setIsOpen: (isOpen: boolean) => void;
  openWithPost: (post: EditPostData) => void;
}

export const useEditCommunityPostModalStore =
  create<EditCommunityPostModalProps>((set) => ({
    isOpen: false,
    post: null,
    setIsOpen: (isOpen) => set({ isOpen, post: isOpen ? undefined : null }),
    openWithPost: (post) => set({ isOpen: true, post }),
  }));
