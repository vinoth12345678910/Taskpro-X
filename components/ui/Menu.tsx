"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import * as Pop from "@radix-ui/react-popover";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const panel =
  "z-50 min-w-44 rounded-lg border border-line bg-surface p-1 text-ink shadow-pop " +
  "data-[state=open]:animate-[tpx-pop_.12s_ease-out]";

export function Menu({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={6} className={panel}>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({ danger, className, ...rest }: ComponentProps<typeof DM.Item> & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-body outline-none",
        "data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...rest}
    />
  );
}

export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;

export function Popover({
  trigger,
  children,
  align = "end",
  className,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Pop.Root open={open} onOpenChange={onOpenChange}>
      <Pop.Trigger asChild>{trigger}</Pop.Trigger>
      <Pop.Portal>
        <Pop.Content align={align} sideOffset={8} collisionPadding={12} className={cn(panel, "p-0", className)}>
          {children}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}
export const PopoverClose = Pop.Close;
