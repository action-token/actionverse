// "use client"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import Link from "next/link"
// import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
// import { Button } from "~/components/shadcn/ui/button"
// import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card"
// import { Badge } from "~/components/shadcn/ui/badge"
// import { Separator } from "~/components/shadcn/ui/separator"
// import { Skeleton } from "~/components/shadcn/ui/skeleton"
// import { Textarea } from "~/components/shadcn/ui/textarea"
// import { useToast } from "~/components/shadcn/ui/use-toast"
// import { api } from "~/utils/api"
// import { getAssetBalanceFromBalance } from "~/lib/stellar/marketplace/test/acc"
// import MediaGallery from "./media-gallery"
// import CommentList from "./comment-list"
// import { Heart, MessageCircle, Share2, ArrowLeft, Lock, Globe, CreditCard, Send } from "lucide-react"
// import { cn } from "~/lib/utils"

// interface SinglePostViewProps {
//     postId: number
// }

// export default function SinglePostView({ postId }: SinglePostViewProps) {
//     const router = useRouter()
//     const { toast } = useToast()
//     const [commentText, setCommentText] = useState("")

//     // Fetch post data
//     const {
//         data: post,
//         isLoading: isLoadingPost,
//         error,
//     } = api.fan.post.getPostById.useQuery({ id: postId }, { refetchOnWindowFocus: false })

//     // Fetch user's asset balances
//     const { data: accBalances } = api.wallate.acc.getUserPubAssetBallances.useQuery()

//     // Fetch post likes
//     const { data: likeStatus } = api.fan.post.getUserLikeStatus.useQuery({ postId }, { refetchOnWindowFocus: false })

//     // Like mutation
//     const likeMutation = api.fan.post.toggleLike.useMutation({
//         onSuccess: () => {
//             utils.fan.post.getUserLikeStatus.invalidate({ postId })
//             utils.fan.post.getPostById.invalidate({ id: postId })
//         },
//         onError: (error) => {
//             toast({
//                 title: "Error",
//                 description: error.message || "Failed to like post",
//                 variant: "destructive",
//             })
//         },
//     })

//     // Comment mutation
//     const commentMutation = api.fan.post.addComment.useMutation({
//         onSuccess: () => {
//             setCommentText("")
//             utils.fan.post.getPostById.invalidate({ id: postId })
//             utils.fan.post.getPostComments.invalidate({ postId })
//             toast({
//                 title: "Comment added",
//                 description: "Your comment has been added successfully",
//             })
//         },
//         onError: (error) => {
//             toast({
//                 title: "Error",
//                 description: error.message || "Failed to add comment",
//                 variant: "destructive",
//             })
//         },
//     })

//     const utils = api.useContext()

//     // Handle like toggle
//     const handleLikeToggle = () => {
//         likeMutation.mutate({ postId })
//     }

//     // Handle comment submission
//     const handleCommentSubmit = () => {
//         if (!commentText.trim()) return

//         commentMutation.mutate({
//             postId,
//             content: commentText,
//         })
//     }

//     // Handle back navigation
//     const handleBack = () => {
//         router.back()
//     }

//     // Loading state
//     if (isLoadingPost) {
//         return (
//             <div className="space-y-4">
//                 <Button variant="ghost" onClick={handleBack} className="mb-4">
//                     <ArrowLeft className="mr-2 h-4 w-4" /> Back
//                 </Button>

//                 <Card>
//                     <CardHeader className="p-4 pb-0">
//                         <div className="flex items-start gap-4">
//                             <Skeleton className="h-12 w-12 rounded-full" />
//                             <div className="space-y-2 flex-1">
//                                 <Skeleton className="h-4 w-1/3" />
//                                 <Skeleton className="h-3 w-1/4" />
//                             </div>
//                         </div>
//                     </CardHeader>
//                     <CardContent className="p-6">
//                         <div className="space-y-4">
//                             <Skeleton className="h-6 w-3/4" />
//                             <div className="space-y-2">
//                                 <Skeleton className="h-4 w-full" />
//                                 <Skeleton className="h-4 w-full" />
//                                 <Skeleton className="h-4 w-2/3" />
//                             </div>
//                             <Skeleton className="h-64 w-full rounded-lg" />
//                         </div>
//                     </CardContent>
//                     <CardFooter className="p-4 flex flex-col">
//                         <div className="flex items-center justify-between w-full mb-2">
//                             <Skeleton className="h-4 w-16" />
//                             <Skeleton className="h-4 w-20" />
//                         </div>
//                         <Separator className="my-2" />
//                         <div className="flex items-center justify-between w-full">
//                             <Skeleton className="h-9 w-24" />
//                             <Skeleton className="h-9 w-24" />
//                             <Skeleton className="h-9 w-24" />
//                         </div>
//                     </CardFooter>
//                 </Card>

//                 <Card className="p-4">
//                     <Skeleton className="h-4 w-32 mb-4" />
//                     <Skeleton className="h-24 w-full rounded-md mb-4" />
//                     <Skeleton className="h-9 w-24 ml-auto" />
//                 </Card>
//             </div>
//         )
//     }

//     // Error state
//     if (error || !post) {
//         return (
//             <div className="text-center py-12">
//                 <h2 className="text-2xl font-bold mb-2">Post not found</h2>
//                 <p className="text-gray-500 dark:text-gray-400 mb-6">
//                     The post you're looking for doesn't exist or you don't have permission to view it.
//                 </p>
//                 <Button onClick={handleBack}>
//                     <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
//                 </Button>
//             </div>
//         )
//     }

//     // Determine if post is locked and if user has access
//     const locked = !!post.subscription
//     let hasAccess = !locked // Public posts are always accessible

//     if (locked && post.subscription) {
//         let pageAssetCode: string | undefined
//         let pageAssetIssuer: string | undefined

//         const customPageAsset = post.creator.customPageAssetCodeIssuer
//         const pageAsset = post.creator.pageAsset

//         if (pageAsset) {
//             pageAssetCode = pageAsset.code
//             pageAssetIssuer = pageAsset.issuer
//         } else if (customPageAsset) {
//             const [code, issuer] = customPageAsset.split("-")
//             pageAssetCode = code
//             pageAssetIssuer = issuer
//         }

//         const bal = getAssetBalanceFromBalance({
//             balances: accBalances,
//             code: pageAssetCode,
//             issuer: pageAssetIssuer,
//         })

//         hasAccess = post.subscription.price <= (bal || 0)
//     }

//     // Format date for display
//     const formatDate = (dateString: string) => {
//         const date = new Date(dateString)
//         return new Intl.DateTimeFormat("en-US", {
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//             hour: "numeric",
//             minute: "numeric",
//         }).format(date)
//     }

//     return (
//         <div className="space-y-6">
//             <Button variant="ghost" onClick={handleBack} className="mb-2">
//                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to Feed
//             </Button>

//             <Card className="overflow-hidden shadow-md">
//                 <CardHeader className="p-6 pb-4">
//                     <div className="flex items-start justify-between">
//                         <div className="flex items-center gap-4">
//                             <Link href={`/creator/${post.creator.id}`}>
//                                 <Avatar className="h-12 w-12 border-2 border-primary/10">
//                                     <AvatarImage
//                                         src={post.creator.profileUrl || "/placeholder.svg?height=48&width=48"}
//                                         alt={post.creator.name}
//                                     />
//                                     <AvatarFallback>{post.creator.name.charAt(0)}</AvatarFallback>
//                                 </Avatar>
//                             </Link>
//                             <div>
//                                 <div className="flex items-center gap-2">
//                                     <Link href={`/creator/${post.creator.id}`} className="font-semibold hover:underline">
//                                         {post.creator.name}
//                                     </Link>
//                                     <Badge variant={locked ? "outline" : "secondary"} className="text-xs">
//                                         {locked ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
//                                         {locked ? "Premium" : "Public"}
//                                     </Badge>
//                                 </div>
//                                 <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(post.createdAt.toString())}</p>
//                             </div>
//                         </div>
//                     </div>
//                 </CardHeader>

//                 <CardContent className="p-6 pt-2">
//                     <div className="space-y-6">
//                         {!hasAccess ? (
//                             <LockedContent
//                                 price={post.subscription?.price || 0}
//                                 assetCode={post.creator.pageAsset?.code || post.creator.customPageAssetCodeIssuer?.split("-")[0] || ""}
//                             />
//                         ) : (
//                             <>
//                                 {post.heading && post.heading !== "Heading" && <h1 className="text-2xl font-bold">{post.heading}</h1>}

//                                 <div className="prose dark:prose-invert max-w-none">
//                                     <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line">{post.content}</p>
//                                 </div>

//                                 {post.medias && post.medias.length > 0 && (
//                                     <div className="mt-4">
//                                         <MediaGallery media={post.medias} />
//                                     </div>
//                                 )}
//                             </>
//                         )}
//                     </div>
//                 </CardContent>

//                 <CardFooter className="p-6 pt-2 flex flex-col">
//                     <div className="flex items-center justify-between w-full text-gray-500 dark:text-gray-400 text-sm mb-2">
//                         <div>{post._count.likes} likes</div>
//                         <div>{post._count.comments} comments</div>
//                     </div>

//                     <Separator className="my-3" />

//                     <div className="flex items-center justify-between w-full">
//                         <Button
//                             variant="ghost"
//                             size="sm"
//                             className={cn("flex-1 gap-2", likeStatus?.liked && "text-red-500 dark:text-red-400 font-medium")}
//                             onClick={handleLikeToggle}
//                             disabled={likeMutation.isPending}
//                         >
//                             <Heart className={cn("h-5 w-5", likeStatus?.liked && "fill-current")} />
//                             Like
//                         </Button>
//                         <Button
//                             variant="ghost"
//                             size="sm"
//                             className="flex-1 gap-2"
//                             onClick={() => document.getElementById("comment-input")?.focus()}
//                         >
//                             <MessageCircle className="h-5 w-5" />
//                             Comment
//                         </Button>
//                         <Button variant="ghost" size="sm" className="flex-1 gap-2">
//                             <Share2 className="h-5 w-5" />
//                             Share
//                         </Button>
//                     </div>
//                 </CardFooter>
//             </Card>

//             {/* Comments Section */}
//             <Card className="overflow-hidden shadow-md">
//                 <CardHeader className="p-6 pb-2">
//                     <h2 className="text-xl font-semibold">Comments</h2>
//                 </CardHeader>

//                 <CardContent className="p-6">
//                     {/* Comment Input */}
//                     <div className="flex gap-4 mb-6">
//                         <Avatar className="h-10 w-10">
//                             <AvatarFallback>U</AvatarFallback>
//                         </Avatar>
//                         <div className="flex-1 space-y-2">
//                             <Textarea
//                                 id="comment-input"
//                                 placeholder="Write a comment..."
//                                 value={commentText}
//                                 onChange={(e) => setCommentText(e.target.value)}
//                                 className="resize-none"
//                             />
//                             <div className="flex justify-end">
//                                 <Button
//                                     onClick={handleCommentSubmit}
//                                     disabled={!commentText.trim() || commentMutation.isPending}
//                                     size="sm"
//                                 >
//                                     {commentMutation.isPending ? (
//                                         <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
//                                     ) : (
//                                         <Send className="h-4 w-4 mr-2" />
//                                     )}
//                                     Post Comment
//                                 </Button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Comments List */}
//                     <CommentList postId={postId} />
//                 </CardContent>
//             </Card>
//         </div>
//     )
// }

// // Component to display when content is locked
// function LockedContent({ price, assetCode }: { price: number; assetCode: string }) {
//     return (
//         <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-8">
//             <div className="flex flex-col items-center text-center space-y-4">
//                 <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
//                     <Lock className="h-8 w-8 text-amber-600 dark:text-amber-500" />
//                 </div>
//                 <div className="space-y-2">
//                     <h3 className="text-xl font-semibold">Premium Content</h3>
//                     <p className="text-gray-500 dark:text-gray-400">
//                         This content requires {price} {assetCode} to view.
//                     </p>
//                 </div>
//                 <Button className="gap-2">
//                     <CreditCard className="h-4 w-4" />
//                     Get Access
//                 </Button>
//             </div>
//         </div>
//     )
// }

