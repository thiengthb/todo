/* Smoke test mức DB: tạo task, done + emotion, task trì hoãn, daily note */
/* eslint-disable @typescript-eslint/no-require-imports -- script CJS chạy bằng node trần */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const today = new Date().toLocaleDateString("en-CA");
  const t = await p.task.create({ data: { title: "Viet bao cao tuan", date: today } });
  console.log("tao:", t.id);
  await p.task.update({
    where: { id: t.id },
    data: { done: true, completedAt: new Date(), emotion: "love" },
  });
  console.log("done+emotion ok");
  const old = await p.task.create({
    data: { title: "Don dep o cung", date: today, carriedFrom: "2026-06-03" },
  });
  console.log("task tri hoan (carriedFrom 03/06):", old.id);
  await p.dailyNote.upsert({
    where: { date: today },
    create: { date: today, note: "Hom nay kha on" },
    update: { note: "Hom nay kha on" },
  });
  console.log("note ok");
  await p.$disconnect();
})();
