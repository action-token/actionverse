import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu";
import { Button } from "../shadcn/ui/button";
import { Spinner } from "../shadcn/ui/spinner";
export default function ContextMenu({
  handleDelete,
  isLoading,
}: {
  handleDelete: () => void;
  isLoading: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-none" size="sm">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-20">
        <DropdownMenuItem onClick={handleDelete} disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner size="small" className="text-black" />
              <span> Deleting...</span>
            </div>
          ) : (
            <>
              <Trash2 />
              <span>Delete</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
