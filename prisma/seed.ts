import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  //Creating Roles
  // await prisma.role.createMany({
  //   data: [
  //     {
  //       code: 'SUPER_ADMIN',
  //     },
  //     {
  //       code: 'COUPLE',
  //     },
  //     {
  //       code: 'VENDOR',
  //     },
  //       {
  //       code: 'BUSINESS_SPONSOR',
  //     },
  //       {
  //       code: 'FAMILY_SPONSOR',
  //     },
  //   ],
  //   skipDuplicates: true,
  // })

  //Admin User
  // const admin_role = await prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });
  // if (admin_role) {
  //   const admin = await prisma.user.create({
  //     data: {
  //       email: "admin@ecomempire.io",
  //       password: bcrypt.hashSync("Abcd1234!@#$", 10),
  //       roleId: admin_role.id,
  //     }
  //   })

  //   // await prisma.user.upsert({
  //   //   where: { email: 'claudine@ecomempire.io' },
  //   //   create: {
  //   //     email_status: "VERIFIED",
  //   //     email: "claudine@ecomempire.io",
  //   //     password: bcrypt.hashSync("Abcd1234!@#$", 10),
  //   //     gender: "MALE",
  //   //     image: "https://elect-space.sgp1.digitaloceanspaces.com/96cdc513-4619-410b-90ea-5809269266fbecom-logo.webp",
  //   //     profile_picture: "https://elect-space.sgp1.digitaloceanspaces.com/96cdc513-4619-410b-90ea-5809269266fbecom-logo.webp",
  //   //     first_name: "Claudine",
  //   //     last_name: "Magno",
  //   //     referCode: "Claudine-Magno",
  //   //     status: true,
  //   //     roleId: admin_role.id,
  //   //   },
  //   //   update: {}
  //   // })

  //   // await prisma.subscription.createMany({
  //   //   data: [
  //   //     {
  //   //       type: "MONTHLY",
  //   //       userId: admin.id,
  //   //       expireDays: 0,
  //   //       expireMonths: 1,
  //   //       expireYears: 0,
  //   //       title: "Monthly Subscription",
  //   //       subTitle: "Price $450 / Monthly",
  //   //       description: "ECom Empire Monthly Subscription",
  //   //       tierOneCommission: 100,
  //   //       tierTwoCommission: 25,
  //   //       tierOnePoints: 100,
  //   //       tierTwoPoints: 25,
  //   //       price: 450,
  //   //       actualPrice: 450
  //   //     },
  //   //     {
  //   //       type: "YEARLY",
  //   //       userId: admin.id,
  //   //       expireDays: 0,
  //   //       expireMonths: 0,
  //   //       expireYears: 1,
  //   //       tierOneCommission: 1000,
  //   //       tierTwoCommission: 300,
  //   //       tierOnePoints: 100,
  //   //       tierTwoPoints: 25,
  //   //       title: "Yearly Subscription",
  //   //       subTitle: "Price $5000 / Yearly",
  //   //       description: "ECom Empire Yearly Subscription",
  //   //       price: 5000,
  //   //       actualPrice: 5000
  //   //     },
  //   //     {
  //   //       type: "OTHER",
  //   //       userId: admin.id,
  //   //       expireDays: 0,
  //   //       expireMonths: 0,
  //   //       expireYears: 1,
  //   //       tierOneCommission: 0,
  //   //       tierTwoCommission: 0,
  //   //       tierOnePoints: 0,
  //   //       tierTwoPoints: 0,
  //   //       visibility: "PRIVATE",
  //   //       title: "Grace Time Subscription",
  //   //       subTitle: "A 15 Days Subscription for the store owner which is assigned by the admin",
  //   //       description: "A 15 Days Subscription for the store owner which is assigned by the admin",
  //   //       price: 0,
  //   //       actualPrice: 0
  //   //     },
  //   //   ]
  //   // })
  // }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })