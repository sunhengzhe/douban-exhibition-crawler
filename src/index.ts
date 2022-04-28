import { PrismaClient } from "@prisma/client";
import Crawler from "./core/Crawler";

const prisma = new PrismaClient()

const crawler = new Crawler(prisma)

crawler.kickoff()