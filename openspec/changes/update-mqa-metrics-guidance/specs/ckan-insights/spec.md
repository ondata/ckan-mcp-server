## ADDED Requirements
### Requirement: MQA output references metrics details
The system SHALL include a guidance note in MQA quality responses indicating that the metrics endpoint can be used to explain score deductions.

#### Scenario: User asks why a score is not maximum
- **WHEN** the user asks for reasons a dataset does not have the maximum MQA score
- **THEN** the system uses the metrics endpoint to identify failing measurements (e.g., boolean metrics with false values)
- **AND** the response cites the relevant failing measurement(s) as the cause of the deduction
