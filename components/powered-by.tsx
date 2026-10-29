import Image from "next/image";

/** "Powered by NxtWave Academy" credit, shown at the top right of every page. */
export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center gap-2 ${className}`}>
      <span className="hidden text-[11px] font-medium uppercase tracking-wider text-muted lg:inline">Powered by</span>
      {/* The logo file has a black square background; crop to the wordmark. */}
      <span className="relative block h-7 w-[62px] overflow-hidden rounded-md bg-black sm:h-8 sm:w-[76px]">
        <Image src="/brand/nxtwave-academy.jpeg" alt="NxtWave Academy" fill sizes="(min-width: 640px) 76px, 62px" priority className="object-cover object-[50%_48%]" />
      </span>
    </span>
  );
}
