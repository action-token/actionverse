import { useSession } from "next-auth/react";
import ContextMenu from "~/components/common/context-menu";
import { api } from "~/utils/api";

export function PostContextMenu({
  creatorId,
  postId,
}: {
  creatorId: string;
  postId: number;
}) {
  const { data } = useSession();
  const deletePost = api.fan.post.deletePost.useMutation();

  const handleDelete = () => deletePost.mutate(postId);

  if (data?.user && data.user.id === creatorId) {
    return (
      <ContextMenu
        handleDelete={handleDelete}
        isLoading={deletePost.isLoading}
      />
    );
  }
}
