import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  ShareIcon,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/utils/api";
import { formatPostCreatedAt } from "~/utils/format-date";
import PostAudioPlayer from "~/components/PostAudioPlayer";

import { AddComment } from "./add-comment";
import CommentView from "./comment";
import { PostContextMenu } from "./post-context-menu";

import { Separator } from "~/components/shadcn/ui/separator";
import Image from "next/image";
import { Button } from "~/components/shadcn/ui/button";
import { useState } from "react";
import { useModal } from "~/lib/state/play/use-modal-store";
import { Media, Post } from "@prisma/client";
import { usePostVideoMedia } from "~/components/context/PostVideoContext";
import { usePlayer } from "~/components/context/PlayerContext";
import PostVideoPlayer from "~/components/PostVideoPlayer";
import DummmyVideoPostPlayer from "~/components/DummyVideoPostPlayer";
import DummyAudioPostPlayer from "~/components/DummyAudioPostPlayer";
import Avater from "~/components/common/avater";
import { Preview } from "~/components/common/quill-preview";

type extendedPost = Post & {
  creator: {
    id: string;
    name: string;
    profileUrl: string | null;
  };
  subscription: {
    price: number;
  } | null;
  _count: { likes: number; comments: number };
  medias: Media[];
};

export function SinglePostView({ post }: { post: extendedPost }) {
  const { onOpen } = useModal();
  const {
    setCurrentVideo,
    currentVideo,
    isPlaying: isVideoPlaying,
    currentVideoPlayingId,
    setVideoCurrentPlayingId,
  } = usePostVideoMedia();
  const {
    setCurrentTrack,
    currentAudioPlayingId,
    isPlaying,
    setCurrentAudioPlayingId,
  } = usePlayer();
  const likeMutation = api.fan.post.likeApost.useMutation();
  const deleteLike = api.fan.post.unLike.useMutation();
  // const { data: likes, isLoading } = api.post.getLikes.useQuery(post.id);
  const { data: liked } = api.fan.post.isLiked.useQuery(post.id);
  const comments = api.fan.post.getComments.useQuery({
    postId: post.id,
  });
  const [commentBox, setCommentBox] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const renderMediaItem = (item: Media, creatorId: string) => {
    switch (item.type) {
      case "IMAGE":
        return (
          <Image
            key={item.id}
            src={item.url}
            alt="Post image"
            width={1000}
            height={1000}
            className=" flex max-h-[450px] min-h-[450px]  w-full  items-center justify-center rounded-lg bg-gray-100 object-cover md:max-h-[550px] md:min-h-[550px]"
          />
        );
      case "VIDEO":
        return (
          <div
            className=" flex max-h-[450px] min-h-[450px]  w-full  items-center justify-center rounded-lg bg-gray-100 md:max-h-[550px] md:min-h-[550px] "
            onClick={() => {
              setCurrentTrack(null);
              setCurrentAudioPlayingId(null);
              if (!isVideoPlaying && currentVideoPlayingId !== item.id) {
                setCurrentVideo({
                  id: item.id,
                  creatorId: creatorId,
                  src: item.url,
                  title: post.heading,
                });
                setVideoCurrentPlayingId(item.id);
              }
            }}
          >
            {currentVideoPlayingId === item.id ? (
              <PostVideoPlayer videoId={item.id} />
            ) : (
              <DummmyVideoPostPlayer
                videoId={item.id}
                name={post.heading}
                artist={creatorId}
                mediaUrl={item.url}
              />
            )}
          </div>
        );
      case "MUSIC":
        return (
          <div className=" flex max-h-[450px] min-h-[450px]  w-full  items-center justify-center rounded-lg bg-gray-100 md:max-h-[550px] md:min-h-[550px] ">
            {currentAudioPlayingId === item.id ? (
              <PostAudioPlayer />
            ) : (
              <DummyAudioPostPlayer
                audioId={item.id}
                name={post.heading}
                artist={creatorId}
                creatorProfileUrl={post.creator.profileUrl}
                mediaUrl={item.url}
              />
            )}
          </div>
        );
      default:
        return null;
    }
  };
  const nextMedia = () => {
    setCurrentMediaIndex((prevIndex) =>
      prevIndex + 1 >= (post.medias.length || 0) ? 0 : prevIndex + 1,
    );
  };

  const prevMedia = () => {
    setCurrentMediaIndex((prevIndex) =>
      prevIndex - 1 < 0 ? (post.medias.length || 1) - 1 : prevIndex - 1,
    );
  };

  const creatorProfileUrl = `/fans/creator/${post.creatorId}`;
  const postUrl = `/fans/posts/${post.id}`;

  return (
    <div className=" flex h-full flex-col items-center  md:p-5 ">
      <h2 className="mb-5 text-center text-2xl font-bold">
        Post by {post.creator.name}
      </h2>
      <div className="w-full ">
        <div className=" ">
          <div className="flex  w-full flex-col items-center justify-between ">
            <div className="rounded-box bg-base-100 flex h-full w-full flex-1 overflow-auto">
              <div className="h-full w-full  overflow-auto">
                <div
                  key={post.id}
                  className="h-full  w-full  overflow-auto  rounded-none   shadow-xl scrollbar-hide"
                >
                  <div className="flex h-full w-full flex-col overflow-auto pt-6  md:px-6">
                    <div>
                      <div className="flex justify-between">
                        <div className="flex gap-2">
                          <div className="h-auto w-auto rounded-full">
                            <Avater
                              className="h-12 w-12"
                              url={post.creator.profileUrl}
                            />
                          </div>
                          <div>
                            <Link
                              href={creatorProfileUrl}
                              className="font-bold"
                            >
                              {post.creator.name}
                            </Link>
                            <p className="text-xs">
                              Posted on {formatPostCreatedAt(post.createdAt)}
                            </p>
                            {/* <p>
                                {post.data.subscription && (
                                  <span className="badge badge-secondary mr-1">
                                    {post.data.subscription.price}
                                  </span>
                                )}
                              </p> */}
                          </div>
                        </div>
                        <PostContextMenu
                          creatorId={post.creatorId}
                          postId={post.id}
                        />
                      </div>
                    </div>
                    <div className="mt-2 ">
                      <p className="ml-4 font-bold">{post.heading}</p>
                      <Preview value={post.content} />
                      {post.medias && post.medias.length > 0 && (
                        <div className="relative flex max-h-[450px] min-h-[450px]  w-full  items-center justify-center rounded-lg bg-gray-100 md:max-h-[550px] md:min-h-[550px]">
                          {post.medias[currentMediaIndex]
                            ? renderMediaItem(
                                post.medias[currentMediaIndex],
                                post.creatorId,
                              )
                            : null}
                          {post.medias.length > 1 && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                className="absolute left-2 top-1/2 -translate-y-1/2 transform"
                                onClick={prevMedia}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 transform"
                                onClick={nextMedia}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className=" flex items-start justify-center gap-2  p-4 ">
                      <div className=" flex w-1/3 items-center justify-center gap-2 p-0">
                        <Button
                          variant="outline"
                          className="w-full gap-1"
                          disabled={
                            deleteLike.isLoading || likeMutation.isLoading
                          }
                          onClick={() =>
                            liked
                              ? deleteLike.mutate(post.id)
                              : likeMutation.mutate(post.id)
                          }
                        >
                          <Heart
                            size={14}
                            color={liked ? "red" : "black"}
                            className={clsx(liked && "text-red fill-red-500 ")}
                          />
                          <p className="font-bold">{post._count.likes}</p>
                          {deleteLike.isLoading || likeMutation.isLoading ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            ""
                          )}
                        </Button>
                      </div>
                      <Link
                        href={postUrl}
                        className="flex w-1/3 items-center justify-center gap-1"
                      >
                        <Button
                          variant="outline"
                          className="w-full gap-1"
                          onClick={() => setCommentBox(true as boolean)}
                        >
                          <MessageCircle size={14} />
                          {post._count.comments > 0 ? (
                            <span> {post._count.comments} Comments</span>
                          ) : (
                            <span> 0 Comment</span>
                          )}
                        </Button>
                      </Link>
                      <Button
                        onClick={() => onOpen("share", { postUrl: postUrl })}
                        variant="outline"
                        className="w-1/3 gap-1"
                      >
                        <ShareIcon size={14} /> Share
                      </Button>
                    </div>
                    <div className="w-full ">
                      <AddComment postId={post.id} />
                      {comments.data && comments.data.length > 0 && (
                        <div className="mb-10 px-4">
                          <div className=" border-base-200 flex flex-col gap-4 rounded-lg border-2 ">
                            <div className=" mt-1 flex flex-col gap-4  rounded-lg p-2">
                              {comments.data?.map((comment) => (
                                <>
                                  <CommentView
                                    key={comment.id}
                                    comment={comment}
                                    childrenComments={comment.childComments}
                                  />
                                  <Separator />
                                </>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
