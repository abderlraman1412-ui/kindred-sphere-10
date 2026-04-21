import { PostFeed } from "@/components/PostFeed";

const TextPosts = () => (
  <div className="space-y-4">
    <h1 className="px-1 text-xl font-bold">Text posts</h1>
    <PostFeed filterType="text" />
  </div>
);
export default TextPosts;
