export interface CompleteErrandRequestDto {
  errandId: string;
  completedBy: 'CLIENT' | 'SYSTEM';
}

export interface CompleteErrandResponseDto {
  errandId: string;
  status: string;
}
