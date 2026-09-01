"use client";

import { useState } from "react";

type Props = {
  name: string;
  placeholder?: string;
  defaultValue?: string | number;
};

function formatValue(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
}

export function FormattedMoneyInput({ name, placeholder, defaultValue = "" }: Props) {
  const [value, setValue] = useState(() => formatValue(String(defaultValue)));
  return (
    <input
      name={name}
      value={value}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      onChange={(event) => setValue(formatValue(event.target.value))}
    />
  );
}
