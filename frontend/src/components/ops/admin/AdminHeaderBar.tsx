import TopBar from "../../layout/TopBar";
import DatePicker from "../../ui/DatePicker";
import Button from "../../ui/Button";

export default function AdminHeaderBar(props: {
  date: string;
  onDateChange: (v: string) => void;
  onLogout: () => void;
}) {
  return (
    <TopBar
      dir="rtl"
      title="مدیریت"
      subtitle="آیتم‌های روزانه را اضافه و مدیریت کنید."
      right={
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">تاریخ</span>
          <DatePicker value={props.date} onChange={props.onDateChange} />
          <Button variant="secondary" onClick={props.onLogout}>
            خروج
          </Button>
        </div>
      }
    />
  );
}
