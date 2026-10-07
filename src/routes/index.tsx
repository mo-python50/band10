import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Archive, KeyRound, Plus, Scale, Users, Vote } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بند — قيّم أي شيء بعدالة ووضوح" },
      { name: "description", content: "أنشئ تقييماً بمعايير موزونة، شارك رمز المحكمين، افتح تصويت الجمهور، واحصل على نتائج محسوبة تلقائياً." },
      { property: "og:title", content: "بند — قيّم أي شيء بعدالة ووضوح" },
      { property: "og:description", content: "معايير موزونة، محكمون برمز، تصويت جمهور، ونتائج فورية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const actions = [
  { to: "/evaluations/new", icon: Plus, title: "إنشاء تقييم جديد", desc: "عناصر، معايير موزونة، محكمون وتصويت جمهور.", primary: true },
  { to: "/join", icon: KeyRound, title: "الانضمام إلى تقييم", desc: "أدخل رمز المحكم مثل BND-4821 وابدأ.", primary: false },
  { to: "/archive", icon: Archive, title: "أرشيف التقييمات", desc: "استعرض تقييماتك السابقة ونتائجها.", primary: false },
] as const;

function Home() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <section className="hero-band">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-14 sm:pt-20">
          <p className="mb-4 inline-block rounded-full border border-primary-foreground/20 px-3 py-1 text-xs text-primary-foreground/80">
            منصة تقييم المسابقات
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            بند
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            قيّم المتسابقين، الأطباق، المسابقات أو أي قائمة — بمعايير موزونة ومحكمين وتصويت جمهور...
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-14 max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((a, i) => (
            <Link
              key={a.to}
              to={a.to}
              style={{ animationDelay: `${i * 60}ms` }}
              className={
                "animate-rise group flex flex-col justify-between gap-6 rounded-2xl border p-6 shadow-lift transition hover:-translate-y-0.5 " +
                (a.primary ? "border-primary bg-primary text-primary-foreground" : "bg-card")
              }
            >
              <div>
                <span className={"grid size-11 place-items-center rounded-xl " + (a.primary ? "bg-primary-foreground/15" : "bg-accent text-accent-foreground")}>
                  <a.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-xl font-semibold">{a.title}</h2>
                <p className={"mt-1 text-sm " + (a.primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{a.desc}</p>
              </div>
              <ArrowLeft className="size-5 transition group-hover:-translate-x-1" />
            </Link>
          ))}
        </div>

        <section className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            { icon: Scale, t: "معايير موزونة", d: "حدّد وزن كل معيار ونطاق درجاته، والمجموع يجب أن يكون ١٠٠٪." },
            { icon: Users, t: "محكمون بلا حسابات", d: "رمز ورابط واحد، والمحكم يقيّم من جواله عنصراً تلو الآخر." },
            { icon: Vote, t: "تصويت الجمهور", d: "اختياري ومنفصل تماماً، بنسبة تحددها أنت في النتيجة النهائية." },
          ].map((f) => (
            <div key={f.t} className="flex gap-4">
              <f.icon className="mt-1 size-5 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
