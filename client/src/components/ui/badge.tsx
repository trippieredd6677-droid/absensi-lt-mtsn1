import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      destructive: "border-transparent bg-destructive text-destructive-foreground",
      outline: "text-foreground",
      hadir: "border-transparent bg-[#e9f1eb] text-[#3a7a55] border-[#c3d8cb]",
      sakit: "border-transparent bg-[#f7efdd] text-[#8f6820]",
      izin: "border-transparent bg-[#e9eef6] text-[#47649c]",
      alpa: "border-transparent bg-[#f7e9e7] text-[#a84343]",
    },
  },
  defaultVariants: { variant: "default" },
})
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }
