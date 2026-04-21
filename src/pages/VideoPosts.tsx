import { PostFeed } from "@/components/PostFeed";

const VideoPosts = () => (
  <div className="space-y-4">
    <h1 className="px-1 text-xl font-bold">Video posts</h1>
    <PostFeed filterType="video" />
  </div>
);
export default VideoPosts;
