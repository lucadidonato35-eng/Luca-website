import { changeDisplayCurrency, changeFxMode } from '@/app/actions';
import { CURRENCIES, DISPLAY_CURRENCIES, type CurrencyCode } from '@/config/currencies';
import type { FxMode } from '@/domain/fx/convert';

const segment =
  'px-2.5 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-700 ' +
  '-ml-px first:ml-0 first:rounded-l last:rounded-r cursor-pointer';
const active = 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900';
const inactive = 'hover:bg-neutral-100 dark:hover:bg-neutral-800';

export function CurrencySwitcher({ current }: { current: CurrencyCode }) {
  return (
    <form action={changeDisplayCurrency} className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500">Display</span>
      <div className="flex">
        {DISPLAY_CURRENCIES.map((code) => (
          <button
            key={code}
            name="currency"
            value={code}
            type="submit"
            title={CURRENCIES[code].name}
            className={`${segment} ${code === current ? active : inactive}`}
          >
            {code}
          </button>
        ))}
      </div>
    </form>
  );
}

export function FxModeToggle({ current }: { current: FxMode }) {
  const modes: Array<{ value: FxMode; label: string; title: string }> = [
    {
      value: 'period-correct',
      label: 'Period FX',
      title: 'Convert each historical point at the rate as of that date',
    },
    {
      value: 'constant',
      label: 'Constant FX',
      title: "Convert every point at today's rate, isolating real portfolio movement",
    },
  ];

  return (
    <form action={changeFxMode} className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500">Rates</span>
      <div className="flex">
        {modes.map((m) => (
          <button
            key={m.value}
            name="mode"
            value={m.value}
            type="submit"
            title={m.title}
            className={`${segment} ${m.value === current ? active : inactive}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </form>
  );
}
