-- CreateTable
CREATE TABLE `Exhibition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `time` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `fee` VARCHAR(191) NOT NULL,
    `cover` VARCHAR(191) NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `participants` INTEGER NOT NULL DEFAULT 0,
    `interested` INTEGER NOT NULL DEFAULT 0,
    `tags` VARCHAR(191) NULL,

    UNIQUE INDEX `Exhibition_eventId_date_key`(`eventId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
