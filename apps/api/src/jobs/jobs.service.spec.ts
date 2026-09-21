import { JobsService } from './jobs.service';

describe('JobsService', () => {
  it('returns 404 for an unknown job', () => {
    const service = new JobsService();
    expect(() => service.getPublic('missing')).toThrow('Job not found');
  });
});
