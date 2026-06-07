/* Xoá đúng các dữ liệu mẫu đã bơm khi dev — không đụng dữ liệu thật */
/* eslint-disable @typescript-eslint/no-require-imports -- script CJS chạy bằng node trần */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const SEED_TITLES = [
  "Viet bao cao tuan",
  "Don dep o cung",
  "Hop team weekly",
  "Review PR backend",
  "Viet unit test",
  "Doc tai lieu Prisma",
  "Don dep inbox",
  "Chuan bi slide demo",
];

const SEED_NOTES = ["Hom nay kha on", "Hop nhieu nhung van xong viec chinh"];

(async () => {
  const t = await p.task.deleteMany({ where: { title: { in: SEED_TITLES } } });
  const n = await p.dailyNote.deleteMany({ where: { note: { in: SEED_NOTES } } });
  console.log(`da xoa ${t.count} task mau, ${n.count} note mau`);
  const left = await p.task.findMany({ orderBy: { date: "asc" } });
  console.log("con lai trong DB:");
  left.forEach((x) =>
    console.log(` - [${x.date}] ${x.title}${x.done ? " (xong)" : ""}`)
  );
  await p.$disconnect();
})();
