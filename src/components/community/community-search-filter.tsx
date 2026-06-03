"use client"

import { Search, SlidersHorizontal } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select"

interface CommunitySearchFilterProps {
  search: string
  onSearchChange: (value: string) => void
  filter: "ALL" | "TOKEN_GATED" | "OPEN"
  onFilterChange: (value: "ALL" | "TOKEN_GATED" | "OPEN") => void
}

export function CommunitySearchFilter({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: CommunitySearchFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search communities..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select
        value={filter}
        onValueChange={(val) => onFilterChange(val as typeof filter)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Communities</SelectItem>
          <SelectItem value="TOKEN_GATED">Token Gated</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
