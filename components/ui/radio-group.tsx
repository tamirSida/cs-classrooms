"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface RadioGroupItemProps {
  value: string;
  id: string;
  children?: React.ReactNode;
  className?: string;
}

const RadioGroupContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function RadioGroup({ value, onValueChange, children, className }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </RadioGroupContext.Provider>
  );
}

function RadioGroupItem({ value, id, children, className }: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext);
  if (!context) throw new Error("RadioGroupItem must be used within RadioGroup");

  const isSelected = context.value === value;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="radio"
          id={id}
          name={id}
          value={value}
          checked={isSelected}
          onChange={() => context.onValueChange(value)}
          className="sr-only"
        />
        <div
          className={cn(
            "h-4 w-4 rounded-full border transition-colors",
            isSelected
              ? "border-primary bg-primary"
              : "border-muted-foreground/50"
          )}
        >
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          )}
        </div>
      </div>
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
