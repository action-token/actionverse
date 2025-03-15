import { useRouter } from "next/router";
import { SinglePostView } from "~/components/fan/post/single-post";
import { api } from "~/utils/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import CreatorLayout from "~/components/layout/root/CreatorLayout";

export default function PostPage() {
  const router = useRouter();

  const postId = router.query.id;

  if (typeof postId == "string") {
    return (
      <CreatorLayout>
        <Page postId={postId} />
      </CreatorLayout>
    );
  }

  return <div>Error</div>;
}

function Page({ postId }: { postId: string }) {
  const router = useRouter();

  const { data, error, isLoading } = api.fan.post.getAPost.useQuery(
    Number(postId),
    {
      refetchOnWindowFocus: false,
      enabled: !!postId,
    },
  );

  if (isLoading) {
    return (
      <Card className="mx-auto mt-8 h-full w-full max-w-2xl">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error ?? !data) {
    return (
      <Card className="mx-auto mt-8 w-full max-w-2xl ">
        <CardHeader></CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <div className=" flex w-full items-center justify-center bg-background">
            <div className="w-full max-w-md p-6 text-center">
              <h1 className="mb-2 text-4xl font-bold">Oops!</h1>
              <div className="mb-8 whitespace-pre font-mono text-4xl">
                {`(╯°□°)╯︵ ┻━┻`}
              </div>
              <h2 className="mb-2 text-xl">Error 404: Post Not Found.</h2>
              <p className="mb-8 text-muted-foreground">
                We couldn{"'"}t find a Post with this URL.
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push("/fans/home")}
                >
                  Go Feed
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return <SinglePostView post={data} />;
}
