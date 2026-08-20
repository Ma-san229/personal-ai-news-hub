CREATE TABLE `newsArticleReadStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsArticleReadStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsArticleReadStates_article_user_unique` UNIQUE(`articleId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `newsArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedId` int NOT NULL,
	`title` varchar(1024) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`urlHash` varchar(64) NOT NULL,
	`sourceName` varchar(256) NOT NULL,
	`category` enum('ai_seitaishi','engineer') NOT NULL,
	`publishedAt` timestamp NOT NULL,
	`excerpt` text,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsArticles_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsArticles_urlHash_unique` UNIQUE(`urlHash`)
);
--> statement-breakpoint
CREATE TABLE `newsFeeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`urlHash` varchar(64) NOT NULL,
	`category` enum('ai_seitaishi','engineer') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastFetchedAt` timestamp,
	`lastFetchStatus` varchar(32),
	`lastFetchMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsFeeds_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsFeeds_urlHash_unique` UNIQUE(`urlHash`)
);
--> statement-breakpoint
CREATE TABLE `newsRefreshSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`cronExpression` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`lastRunStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsRefreshSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsRefreshSchedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `newsRefreshSchedules_taskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `newsArticleReadStates_user_idx` ON `newsArticleReadStates` (`userId`);--> statement-breakpoint
CREATE INDEX `newsArticles_category_published_idx` ON `newsArticles` (`category`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `newsArticles_feed_published_idx` ON `newsArticles` (`feedId`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `newsFeeds_category_active_idx` ON `newsFeeds` (`category`,`isActive`);