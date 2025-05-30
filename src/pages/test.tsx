"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { z } from "zod";

import { useState } from "react";
import { Button } from "~/components/shadcn/ui/button";
import { Calendar } from "~/components/shadcn/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/shadcn/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/shadcn/ui/popover";
import { cn } from "~/lib/utils";

const FormSchema = z.object({
  dob: z.date({
    required_error: "A date of birth is required.",
  }),
});

export default function DatePickerPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: undefined,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">Click here to select date</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Select Date Range</DialogTitle>
            </DialogHeader>

            <div className="p-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "PPP")} -{" "}
                          {format(dateRange.to, "PPP")}
                        </>
                      ) : (
                        format(dateRange.from, "PPP")
                      )
                    ) : (
                      <span>Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {dateRange?.from && dateRange?.to && (
                <div className="mt-4 rounded-md bg-gray-50 p-4">
                  <p className="font-medium">Selected Range:</p>
                  <p className="text-sm text-gray-600">
                    Start: {format(dateRange.from, "MMMM dd, yyyy")}
                  </p>
                  <p className="text-sm text-gray-600">
                    End: {format(dateRange.to, "MMMM dd, yyyy")}
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setIsDialogOpen(false)}
                  disabled={!dateRange?.from || !dateRange?.to}
                >
                  Confirm Selection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {dateRange?.from && dateRange?.to && !isDialogOpen && (
          <div className="mt-4 rounded-md bg-white p-4 shadow-md">
            <p className="font-medium">Your selected date range:</p>
            <p className="text-lg font-bold">
              {format(dateRange.from, "MMMM dd, yyyy")} -{" "}
              {format(dateRange.to, "MMMM dd, yyyy")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
