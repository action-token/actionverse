"use client"

import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { CommunityPostCard } from "~/components/community/community-post-card"
import { LockedContent } from "~/components/community/locked-content"
import { EditCommunityPostModal } from "~/components/modal/edit-community-post-modal"
import { CommunityMemberDialog } from "~/components/modal/community-member-dialog"
import { CommunityInviteModal } from "~/components/modal/community-invite-modal"
import ConnectWalletButton from "~/components/common/wallate_button"

const CommunityPostPage = () => {
  const router = useRouter()
  const { id, postId } = router.query
  const communityId = Number(id)
  const postIdNum = Number(postId)
  const { data: session, status: sessionStatus } = useSession()

  const { data, isLoading } = api.community.post.getById.useQuery(
    { postId: postIdNum },
    { enabled: !!postId && !isNaN(postIdNum) },
  )

  if (isLoading || sessionStatus === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found</p>
        <Link href="/community">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Communities
          </Button>
        </Link>
      </div>
    )
  }

  const { community } = data

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <BackLink communityId={communityId} title={community.title} />

        <div className="mt-6 flex flex-col items-center gap-6 rounded-xl border border-dashed p-10 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Connect your wallet to view this post
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access community posts and interact with members.
            </p>
          </div>
          <ConnectWalletButton />
        </div>
      </div>
    )
  }

  if (data.locked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <BackLink communityId={communityId} title={community.title} />

        <div className="mt-6">
          {community.isMember ? (
            <LockedContent
              tokenRequirements={community.tokenRequirements}
              tokenGateLogic={community.tokenGateLogic}
              message="This post is in a token-gated community. Content is restricted."
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">
                  Join the community to view this post
                </h2>
                <p className="text-sm text-muted-foreground">
                  You need to be a member of {community.title} to access this
                  content.
                </p>
              </div>
              <Link href={`/community/${communityId}`}>
                <Button className="gap-2 rounded-full">
                  <Users className="h-4 w-4" />
                  View Community & Join
                </Button>
              </Link>
              {community.isTokenGated &&
                community.tokenRequirements.length > 0 && (
                  <LockedContent
                    tokenRequirements={community.tokenRequirements}
                    tokenGateLogic={community.tokenGateLogic}
                    message="This community requires tokens to join."
                  />
                )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!data.post) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found</p>
        <Link href={`/community/${communityId}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Community
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
      <BackLink communityId={communityId} title={community.title} />

      <div className="mt-4">
        <CommunityPostCard
          post={data.post}
          communityOwnerId={community.ownerId}
          communityId={communityId}
        />
      </div>

      <EditCommunityPostModal />
      <CommunityMemberDialog isOwner={community.isOwner} />
      <CommunityInviteModal />
    </div>
  )
}

function BackLink({
  communityId,
  title,
}: {
  communityId: number
  title: string
}) {
  return (
    <Link
      href={`/community/${communityId}`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to {title}
    </Link>
  )
}

export default CommunityPostPage
