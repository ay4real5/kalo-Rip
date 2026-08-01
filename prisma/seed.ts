import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.create({
    data: {
      email: "admin@kalo.rip",
      name: "School Admin",
      role: "ADMIN",
      phone: "+447000000001",
    },
  });

  const instructorUser = await prisma.user.create({
    data: {
      email: "jane@kalo.rip",
      name: "Jane Smith",
      role: "INSTRUCTOR",
      phone: "+447000000002",
      instructor: {
        create: {
          bio: "Friendly automatic instructor based in Croydon",
          basePostcode: "CR0 1AA",
          servicePostcodes: ["CR0", "CR1", "CR2", "CR7", "SE25"],
          vehicleType: "Vauxhall Corsa Auto",
          transmission: "AUTOMATIC",
          lessonDurationMinutes: 60,
          travelBufferMinutes: 15,
          maxLessonsPerDay: 6,
          hourlyRatePence: 3800,
          acceptsNewLearners: true,
          offersIntensive: true,
          availability: {
            create: [
              { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
              { dayOfWeek: 2, startTime: "12:00", endTime: "20:00" },
              { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
              { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
            ],
          },
        },
      },
    },
    include: { instructor: true },
  });

  const instructorUser2 = await prisma.user.create({
    data: {
      email: "tom@kalo.rip",
      name: "Tom Brown",
      role: "INSTRUCTOR",
      phone: "+447000000003",
      instructor: {
        create: {
          bio: "Manual instructor covering South London",
          basePostcode: "SE25 5BP",
          servicePostcodes: ["SE25", "SE26", "SE27", "CR7"],
          vehicleType: "Ford Fiesta",
          transmission: "MANUAL",
          lessonDurationMinutes: 60,
          travelBufferMinutes: 15,
          maxLessonsPerDay: 5,
          hourlyRatePence: 3500,
          acceptsNewLearners: true,
          offersIntensive: false,
          availability: {
            create: [
              { dayOfWeek: 1, startTime: "10:00", endTime: "18:00" },
              { dayOfWeek: 3, startTime: "10:00", endTime: "18:00" },
              { dayOfWeek: 5, startTime: "10:00", endTime: "18:00" },
            ],
          },
        },
      },
    },
    include: { instructor: true },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: "learner@example.com",
      name: "Alex Johnson",
      role: "CUSTOMER",
      phone: "+447000000004",
      customer: {
        create: {
          postcode: "CR0 1AA",
          transmission: "AUTOMATIC",
          experienceLevel: "BEGINNER",
        },
      },
    },
    include: { customer: true },
  });

  console.log({ admin, instructorUser, instructorUser2, customerUser });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
