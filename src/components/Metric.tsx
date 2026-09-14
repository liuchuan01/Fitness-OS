type MetricProps = {
  label: string;
  suffix?: string;
  value: number | string;
};

export function Metric({ label, suffix, value }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
    </div>
  );
}
