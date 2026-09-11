"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { cn } from "@/lib/utils";

/**
 * The category and location a facility report needs on top of the shared
 * composer fields. `pending` renders the same two controls stood down, so the
 * route skeleton is this component rather than an imitation of it.
 */
export function FacilityComposerFields({
  categories,
  category,
  location,
  onCategoryChange,
  onLocationChange,
  pending = false,
}: {
  categories: ReadonlyArray<{ id: string; label: string }>;
  category: string;
  location: string;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  pending?: boolean;
}) {
  useLocaleSubscription();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label>{translate("ui.access.facilityCategory")}</Label>
        <Select
          disabled={pending}
          onValueChange={onCategoryChange}
          value={category}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="facility-location">
            {translate("ui.facility.location")}
          </Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              location.length > INPUT_LIMITS.facilityLocation
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {location.length} / {INPUT_LIMITS.facilityLocation}
          </span>
        </div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            disabled={pending}
            id="facility-location"
            maxLength={INPUT_LIMITS.facilityLocation}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder={translate("ui.facility.locationExample")}
            value={location}
          />
        </div>
      </div>
    </div>
  );
}
