import * as React from "react";
import { ChatCircle, GearSix, Megaphone, ShieldCheck, SignOut, BellRinging, Wrench } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Field, Input, Textarea } from "@/ui/field";
import { Skeleton, Spinner } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import { Panel, SectionTitle, Tile } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { Sheet } from "@/ui/sheet";
import { Switch } from "@/ui/switch";

export function GallerySections() {
  const { t } = useI18n();
  const [view, setView] = React.useState("issues");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [push, setPush] = React.useState(true);
  return (
    <div className="grid gap-6 md:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <Panel interactive>
          <p className="text-[1.0625rem] leading-9">
            <Chip className="mr-2 align-middle">Review</Chip>
            3 proposals are waiting for your review by Thursday 4 PM
          </p>
        </Panel>
        <Panel interactive>
          <p className="text-[1.0625rem] leading-9">
            <Chip className="mr-2 align-middle" tone="info"><Wrench weight="bold" />In progress</Chip>
            Second-floor water fountain repair was picked up by facilities
          </p>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center gap-2 text-ink-muted"><ChatCircle className="size-5" />Proposal status</div>
          <div className="grid grid-cols-3 gap-2">
            <Tile><p className="text-sm text-ink-muted">In review</p><p className="mt-1 text-3xl font-semibold">12</p></Tile>
            <Tile><p className="text-sm text-ink-muted">Active</p><p className="mt-1 text-3xl font-semibold">5</p></Tile>
            <Tile><p className="text-sm text-ink-muted">Done</p><p className="mt-1 text-3xl font-semibold">48</p></Tile>
          </div>
        </Panel>
      </div>

      <div className="grid content-start gap-6">
        <Segmented
          className="justify-self-start"
          label={t("ui.nav.feed")}
          onChange={setView}
          options={[
            { label: t("ui.nav.issues"), value: "issues" },
            { label: t("ui.nav.announcements"), value: "announcements" },
            { label: t("ui.nav.facilities"), value: "facilities" },
          ]}
          value={view}
        />

        <section className="grid gap-3">
          <div className="flex items-center gap-4 px-1">
            <Avatar className="size-14 text-lg" name="Tavric" />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">tavric</h1>
              <p className="truncate text-ink-muted">tavric@school.edu.tw</p>
            </div>
          </div>
          <ListGroup>
            <ListRow href="#" icon={<GearSix />} label="Preferences" />
            <ListRow href="#" icon={<ShieldCheck />} label="Admin" value="3 pending" />
            <ListRow icon={<BellRinging />} label="Push notifications" trailing={<Switch aria-label="Push notifications" checked={push} onCheckedChange={setPush} />} />
            <ListRow icon={<SignOut />} label="Sign out" onClick={() => undefined} tone="danger" />
          </ListGroup>
        </section>

        <section className="grid gap-3">
          <SectionTitle>Buttons and chips</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Submit</Button>
            <Button>Save draft</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Delete</Button>
            <Button onClick={() => setSheetOpen(true)} size="sm" variant="primary">Open sheet</Button>
            <Button aria-label="New" size="icon" variant="primary"><Megaphone /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip>Neutral</Chip><Chip tone="positive">Done</Chip><Chip tone="caution">In review</Chip><Chip tone="danger">Rejected</Chip><Chip tone="info">Active</Chip>
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle>Form</SectionTitle>
          <Panel className="grid gap-4">
            <Field hint="Up to 80 characters" label="Title">{(ids) => <Input aria-describedby={ids.describedBy} id={ids.id} placeholder="What should change?" />}</Field>
            <Field error="Describe the problem" label="Details">{(ids) => <Textarea aria-describedby={ids.describedBy} aria-invalid={ids.invalid} id={ids.id} />}</Field>
          </Panel>
        </section>

        <section className="grid gap-3">
          <SectionTitle action={<Spinner label="Loading" />}>Loading states</SectionTitle>
          <Panel className="grid gap-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /></Panel>
        </section>
      </div>

      <Sheet
        description="A bottom sheet on phones, centred from the tablet breakpoint up."
        footer={<><Button onClick={() => setSheetOpen(false)} variant="ghost">Cancel</Button><Button onClick={() => setSheetOpen(false)} variant="primary">Confirm</Button></>}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        title="Update status"
      >
        <p className="text-ink-muted">The body scrolls on its own.</p>
      </Sheet>
    </div>
  );
}
