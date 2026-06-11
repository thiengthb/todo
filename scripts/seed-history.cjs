/* Bơm dữ liệu nhiều ngày để thử tính năng lịch sử */
/* eslint-disable @typescript-eslint/no-require-imports -- script CJS chạy bằng node trần */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function dstr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
}

(async () => {
  // Hôm qua: 2/3 xong, có cảm xúc + note
  const y = dstr(-1);
  await p.task.createMany({
    data: [
      { title: 'Hop team weekly', date: y, done: true, emotion: 'meh', completedAt: new Date() },
      { title: 'Review PR backend', date: y, done: true, emotion: 'love', completedAt: new Date() },
      { title: 'Viet unit test', date: y, done: false },
    ],
  });
  await p.dailyNote.upsert({
    where: { date: y },
    create: { date: y, note: 'Hop nhieu nhung van xong viec chinh' },
    update: {},
  });

  // 3 ngày trước: 1/2
  const d3 = dstr(-3);
  await p.task.createMany({
    data: [
      {
        title: 'Doc tai lieu Prisma',
        date: d3,
        done: true,
        emotion: 'love',
        completedAt: new Date(),
      },
      { title: 'Don dep inbox', date: d3, done: false },
    ],
  });

  // Ngày mai: 2 việc kế hoạch
  const tm = dstr(1);
  await p.task.createMany({
    data: [
      { title: 'Chuan bi slide demo', date: tm },
      { title: 'Viet unit test', date: tm, carriedFrom: y },
    ],
  });

  console.log('seed xong:', { homqua: y, ba_ngay_truoc: d3, ngaymai: tm });
  await p.$disconnect();
})();
