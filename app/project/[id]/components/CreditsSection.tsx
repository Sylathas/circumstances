"use client";

type CreditRow = { name: string; role: string };

type CreditsSectionProps = {
  creditNames: CreditRow[];
  isAdmin: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "name" | "role", value: string) => void;
};

export default function CreditsSection({
  creditNames,
  isAdmin,
  onAdd,
  onRemove,
  onUpdate,
}: CreditsSectionProps) {
  return (
    <section className="mb-40 px-2">
      <h2
        className="text-[#171717] uppercase text-xs mb-3"
        style={{ fontWeight: 500 }}
      >
        CREDITS
      </h2>
      <div className="space-y-3 text-[#171717] w-1/4">
        {creditNames.map((credit, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-2 items-center group mb-[-7px]"
          >
            {isAdmin ? (
              <>
                <input
                  value={credit.name}
                  onChange={(e) => onUpdate(index, "name", e.target.value)}
                  className="bg-transparent border-none outline-none font-inherit text-xs"
                  placeholder="Name"
                  style={{ fontWeight: 500 }}
                />
                <div className="flex items-center gap-2">
                  <input
                    value={credit.role}
                    onChange={(e) => onUpdate(index, "role", e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none font-inherit text-xs"
                    placeholder="Role"
                    style={{ fontWeight: 500 }}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="w-6 h-6 flex items-center justify-center text-[#171717] opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove credit"
                  >
                    ×
                  </button>
                </div>
              </>
            ) : (
              <>
                <span
                  className="text-[#171717] text-xs"
                  style={{ fontWeight: 500 }}
                >
                  {credit.name}
                </span>
                <span
                  className="text-[#171717] text-xs"
                  style={{ fontWeight: 500 }}
                >
                  {credit.role}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 text-sm font-normal text-[#171717] border-none bg-transparent cursor-pointer"
        >
          +
        </button>
      )}
    </section>
  );
}
