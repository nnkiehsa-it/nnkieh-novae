import Image from "next/image";
import { Megaphone, MessageCircle, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";

export function LoginStory() {
  const { t } = useI18n();
  return (
    <section className="login-story" aria-labelledby="login-story-title">
      <div className="t-stagger-list">
        <h1 className="t-stagger-item login-headline" id="login-story-title">
          {t("ui.login.heading")}<br />
          <span>{t("ui.login.headingAccent")}</span>
        </h1>
        <p className="t-stagger-item login-description">{t("ui.login.subheading")}</p>
      </div>
      <div className="login-illustration" aria-hidden="true">
        <Image className="login-emblem" src="/logo.svg" alt="" width={240} height={240} preload />
        <span className="login-note login-note-idea"><MessageCircle />{t("ui.login.idea")}</span>
        <span className="login-note login-note-repair"><Wrench />{t("ui.login.repair")}</span>
        <span className="login-note login-note-news"><Megaphone />{t("ui.login.news")}</span>
      </div>
    </section>
  );
}
