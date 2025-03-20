import { Hexagon } from "lucide-react";
import CustomAvatar, { HexagonAvatar } from "~/components/common/custom-avatar";

export default function Test() {
  return (
    <div className="bg-red-200 p-3">
      <CustomAvatar url="https://avatars.githubusercontent.com/u/47269261?v=4" />
      <HexagonAvatar />
    </div>
  );
}
