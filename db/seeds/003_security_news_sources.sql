SET NAMES utf8mb4;

INSERT INTO sources (name, site_url, feed_url, source_type, kind, region, crawl_interval_min) VALUES
  ('데일리시큐', 'https://www.dailysecu.com', 'https://www.dailysecu.com/rss/allArticle.xml', 'COMPANY', 'SECURITY_NEWS', 'DOMESTIC', 30),
  ('KISA 보호나라 보안공지', 'https://www.boho.or.kr', 'https://www.boho.or.kr/kr/rss.do?bbsId=B0000133', 'COMPANY', 'SECURITY_NEWS', 'DOMESTIC', 60),
  ('AhnLab ASEC', 'https://asec.ahnlab.com/ko', 'https://asec.ahnlab.com/ko/feed/', 'COMPANY', 'SECURITY_NEWS', 'DOMESTIC', 30),
  ('The Hacker News', 'https://thehackernews.com', 'https://feeds.feedburner.com/TheHackersNews', 'COMPANY', 'SECURITY_NEWS', 'OVERSEAS', 30),
  ('BleepingComputer', 'https://www.bleepingcomputer.com', 'https://www.bleepingcomputer.com/feed/', 'COMPANY', 'SECURITY_NEWS', 'OVERSEAS', 30),
  ('SecurityWeek', 'https://www.securityweek.com', 'https://www.securityweek.com/feed/', 'COMPANY', 'SECURITY_NEWS', 'OVERSEAS', 30)
ON DUPLICATE KEY UPDATE name = VALUES(name), site_url = VALUES(site_url), source_type = VALUES(source_type),
  kind = VALUES(kind), region = VALUES(region), crawl_interval_min = VALUES(crawl_interval_min);
