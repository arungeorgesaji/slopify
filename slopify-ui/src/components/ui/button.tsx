/* eslint-disable react-refresh/only-export-components */
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[3px] border border-transparent bg-clip-padding font-mono text-sm font-bold tracking-[0.04em] whitespace-nowrap uppercase transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-acid/70 bg-[linear-gradient(180deg,var(--acid),var(--acid-muted))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(51,69,39,0.48),0_12px_24px_rgba(0,0,0,0.34),0_0_24px_rgba(183,214,106,0.18)] hover:-translate-y-0.5 hover:border-cyan/70 hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-2px_0_rgba(51,69,39,0.5),0_16px_32px_rgba(0,0,0,0.4),0_0_30px_rgba(183,214,106,0.22)]",
        outline:
          "border-border bg-background/70 text-foreground shadow-[inset_0_1px_0_rgba(238,244,237,0.06),0_8px_18px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 hover:border-cyan/60 hover:bg-cyan/10 hover:text-cyan hover:shadow-[inset_0_1px_0_rgba(238,244,237,0.08),0_12px_24px_rgba(0,0,0,0.28),0_0_18px_rgba(122,184,176,0.14)] aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border-border bg-[linear-gradient(180deg,var(--surface-3),var(--surface-2))] text-secondary-foreground shadow-[inset_0_1px_0_rgba(238,244,237,0.07),0_9px_20px_rgba(0,0,0,0.26)] hover:-translate-y-0.5 hover:border-amber/55 hover:bg-amber/10 hover:text-amber hover:shadow-[inset_0_1px_0_rgba(238,244,237,0.09),0_13px_26px_rgba(0,0,0,0.32),0_0_18px_rgba(199,164,90,0.12)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground/85 hover:-translate-y-0.5 hover:bg-acid/10 hover:text-acid aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
