import { useState } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "~/utils/api";

import { MediaType } from "@prisma/client";
import {
  FileAudio,
  FileVideo,
  ImageIcon,
  Music,
  Users2,
  Video,
  X,
} from "lucide-react";
import clsx from "clsx";
import Image from "next/image";
import { PostCard } from "./post";

import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/shadcn/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import toast from "react-hot-toast";
import { router } from "@trpc/server";
import { useRouter } from "next/router";
import { UploadS3Button } from "~/pages/test";
import Avater from "~/components/common/avater";
import { Editor } from "~/components/common/editor";

const mediaTypes = [
  { type: MediaType.IMAGE, icon: ImageIcon },
  { type: MediaType.VIDEO, icon: Video },
  { type: MediaType.MUSIC, icon: Music },
];

export const MediaInfo = z.object({
  url: z.string(),
  type: z.nativeEnum(MediaType),
});

type MediaInfoType = z.TypeOf<typeof MediaInfo>;

export const PostSchema = z.object({
  heading: z.string().min(1, { message: "Required" }),
  content: z.string().min(2, { message: "Minimum 2 characters required." }),
  subscription: z.string().optional(),
  medias: z.array(MediaInfo).optional(),
});

export function CreatPost() {
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof PostSchema>>({
    resolver: zodResolver(PostSchema),
  });

  const [media, setMedia] = useState<MediaInfoType[]>([]);
  const [wantMediaType, setWantMedia] = useState<MediaType>();
  const router = useRouter();
  const creator = api.fan.creator.meCreator.useQuery();
  const createPostMutation = api.fan.post.create.useMutation({
    onSuccess: async (data) => {
      reset();
      toast.success("Post Created");
      setMedia([]);
      if (data) {
        await router.push(`/fans/posts/${data.id}`);
      }
    },
  });
  const tiers = api.fan.member.getAllMembership.useQuery();

  const onSubmit: SubmitHandler<z.infer<typeof PostSchema>> = (data) => {
    data.medias = media;
    createPostMutation.mutate(data);
  };

  const addMediaItem = (url: string, type: MediaType) => {
    setMedia((prevMedia) => [...prevMedia, { url, type }]);
  };

  const handleWantMediaType = (type: MediaType) => {
    setWantMedia((prevType) => (prevType === type ? undefined : type));
  };

  function handleEditorChange(value: string): void {
    setValue("content", value);
  }

  if (!creator.data)
    return (
      <div className="text-center text-lg font-semibold">
        You are not a creator
      </div>
    );

  function TiersOptions() {
    if (tiers.isLoading)
      return (
        <div className="h-10 w-full animate-pulse bg-muted sm:w-[180px]"></div>
      );
    if (tiers.data) {
      return (
        <Controller
          name="subscription"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Choose Subscription Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                {tiers.data.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={model.id.toString()}
                  >{`${model.name} : ${model.price} ${model.creator.pageAsset?.code}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      );
    }
  }

  return (
    <Card className="w-full px-0 md:px-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader className="flex flex-col items-start justify-between space-y-2 pb-2 sm:flex-row sm:items-center sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Avater className="h-10 w-10" url={creator.data.profileUrl} />
            <span className="font-semibold">{creator.data.name}</span>
          </div>
          <div className="flex w-full items-center space-x-2 sm:w-auto">
            <Users2 size={20} />
            <TiersOptions />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 ">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Add a title..."
              {...register("heading")}
              className={clsx(errors.heading && "border-red-500")}
            />
            {errors.heading && (
              <p className="text-sm text-red-500">{errors.heading.message}</p>
            )}
          </div>
          <div className=" space-y-2">
            <Editor
              onChange={handleEditorChange}
              value={getValues("content")}
            />
            {errors.content && (
              <p className="text-sm text-red-500">{errors.content.message}</p>
            )}
          </div>
          <div className="">
            <div className="mb-8 mt-20 flex flex-wrap gap-2  ">
              {media.map((el, id) => (
                <div key={id} className="relative">
                  {el.type === MediaType.IMAGE ? (
                    <Image
                      src={el.url}
                      alt="Uploaded media"
                      height={100}
                      width={100}
                      className="h-[100px] w-[100px] rounded-md object-cover"
                    />
                  ) : el.type === MediaType.VIDEO ? (
                    <div className="flex h-[100px] w-[100px] items-center justify-center rounded-md bg-gray-200">
                      <FileVideo className="h-12 w-12 text-gray-500" />
                    </div>
                  ) : (
                    <div className="flex h-[100px] w-[100px] items-center justify-center rounded-md bg-gray-200">
                      <FileAudio className="h-12 w-12 text-gray-500" />
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute right-0 top-0 h-6 w-6"
                    onClick={() =>
                      setMedia(media.filter((_, index) => index !== id))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {mediaTypes.map(({ type, icon: IconComponent }) => (
                  <Button
                    key={type}
                    size="sm"
                    type="button"
                    variant={wantMediaType === type ? "default" : "outline"}
                    onClick={() => handleWantMediaType(type)}
                    className="flex-1 sm:flex-none"
                  >
                    <IconComponent className="mr-2 h-4 w-4" />
                    {type}
                  </Button>
                ))}
              </div>
              {wantMediaType === "IMAGE" ? (
                <UploadS3Button
                  endpoint="imageUploader"
                  onClientUploadComplete={(res) => {
                    const data = res;
                    if (data?.url) {
                      addMediaItem(data.url, wantMediaType);
                      setWantMedia(undefined);
                    }
                  }}
                  onUploadError={(error: Error) => {
                    // Do something with the error.
                    toast.error(`ERROR! ${error.message}`);
                  }}
                />
              ) : wantMediaType === "VIDEO" ? (
                <UploadS3Button
                  endpoint="videoUploader"
                  onClientUploadComplete={(res) => {
                    const data = res;
                    if (data?.url) {
                      addMediaItem(data.url, wantMediaType);
                      setWantMedia(undefined);
                    }
                  }}
                  onUploadError={(error: Error) => {
                    // Do something with the error.
                    toast.error(`ERROR! ${error.message}`);
                  }}
                />
              ) : (
                wantMediaType === "MUSIC" && (
                  <UploadS3Button
                    endpoint="musicUploader"
                    onClientUploadComplete={(res) => {
                      const data = res;
                      if (data?.url) {
                        addMediaItem(data.url, wantMediaType);
                        setWantMedia(undefined);
                      }
                    }}
                    onUploadError={(error: Error) => {
                      // Do something with the error.
                      toast.error(`ERROR! ${error.message}`);
                    }}
                  />
                )
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="mt-8 flex flex-col items-stretch justify-between space-y-2 ">
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={createPostMutation.isLoading}
          >
            {createPostMutation.isLoading && (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></span>
            )}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PostList(props: { id: string }) {
  const posts = api.fan.post.getPosts.useInfiniteQuery(
    {
      pubkey: props.id,
      limit: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  if (posts.isLoading) return <div>Loading...</div>;
  if (posts.data) {
    return (
      <div className="bg-base-100 flex w-full flex-col items-center gap-4 p-2 md:container md:mx-auto ">
        {posts.data.pages[0]?.posts.length === 0 && (
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-lg font-semibold">No Post Found Yet!</p>
            </CardContent>
          </Card>
        )}
        {posts.data?.pages.map((page) =>
          page.posts.map((post) => (
            <PostCard
              commentCount={post._count.comments}
              creator={post.creator}
              key={post.id}
              post={post}
              likeCount={post._count.likes}
              locked={post.subscription ? true : false}
              media={post.medias ? post.medias : []}
              show
            />
          )),
        )}

        {posts.hasNextPage && (
          <button
            className="btn btn-outline btn-primary"
            onClick={() => void posts.fetchNextPage()}
          >
            Load More
          </button>
        )}
      </div>
    );
  }
}

export function PostMenu(props: { id: string }) {
  return (
    <div className="my-4 ">
      {/* <CreatPost /> */}
      <PostList id={props.id} />
    </div>
  );
}
