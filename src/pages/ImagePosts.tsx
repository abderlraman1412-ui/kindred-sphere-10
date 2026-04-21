import { PostFeed } from "@/components/PostFeed";

const ImagePosts = () => (
  <div className="space-y-4">
    <h1 className="px-1 text-xl font-bold">Image posts</h1>
    <PostFeed filterType="image" />
  </div>
);
export default ImagePosts;
