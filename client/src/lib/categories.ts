const LABELS: Record<string, string> = {
  백엔드: 'Backend',
  프론트엔드: 'Frontend',
  데이터: 'Data',
  데이터베이스: 'Database',
  인프라: 'Infra',
  데브옵스: 'DevOps',
  클라우드: 'Cloud',
  모바일: 'Mobile',
  보안: 'Security',
  아키텍처: 'Architecture',
  언어: 'Language',
  품질: 'Quality',
  디자인: 'Design',
  도메인: 'Domain',
};

export function categoryLabel(category: string): string {
  return LABELS[category] ?? category;
}
