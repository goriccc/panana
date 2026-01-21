import Image from "next/image";

export function PananaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`select-none text-center ${className}`}>
      <div className="mx-auto w-fit">
        <Image
          src="/panana.png"
          alt="Panana"
          width={440}
          height={128}
          priority
          sizes="260px"
          className="mx-auto h-auto w-[260px]"
        />
        <Image
          src="/randing.png"
          alt=""
          width={23}
          height={6}
          priority
          sizes="23px"
          className="mx-auto mt-4"
        />
      </div>
    </div>
  );
}

