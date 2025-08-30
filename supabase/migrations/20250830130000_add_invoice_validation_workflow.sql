-- Add invoice validation workflow support to project_documents
-- This enables the employee-to-manager validation process

-- Add validation status column
ALTER TABLE project_documents 
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'submitted' 
CHECK (validation_status IN ('submitted', 'pending', 'validated', 'rejected'));

-- Add validation metadata
ALTER TABLE project_documents 
ADD COLUMN IF NOT EXISTS validation_metadata JSONB DEFAULT '{}';

-- Add validated_by and validated_at columns
ALTER TABLE project_documents 
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Add OCR result storage
ALTER TABLE project_documents 
ADD COLUMN IF NOT EXISTS ocr_result JSONB;

-- Add rejection reason
ALTER TABLE project_documents 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for validation queries
CREATE INDEX IF NOT EXISTS idx_project_documents_validation_status 
ON project_documents(validation_status, document_type);

-- Create index for manager validation queries
CREATE INDEX IF NOT EXISTS idx_project_documents_pending_validation 
ON project_documents(validation_status, created_at) 
WHERE validation_status IN ('submitted', 'pending');

-- Create function to get pending validations for managers
CREATE OR REPLACE FUNCTION get_pending_invoice_validations(manager_company_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    project_name TEXT,
    document_name TEXT,
    file_url TEXT,
    created_by UUID,
    employee_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    amount NUMERIC,
    description TEXT,
    ocr_result JSONB,
    validation_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pd.id,
        pd.project_id,
        p.name as project_name,
        pd.name as document_name,
        pd.file_url,
        pd.created_by,
        COALESCE(up.display_name, up.full_name) as employee_name,
        pd.created_at,
        (pd.metadata->>'amount')::numeric as amount,
        pd.metadata->>'description' as description,
        pd.ocr_result,
        pd.validation_status
    FROM project_documents pd
    LEFT JOIN projects p ON pd.project_id = p.id
    LEFT JOIN user_profiles up ON pd.created_by = up.id
    WHERE pd.document_type = 'receipt'
      AND pd.validation_status IN ('submitted', 'pending')
      AND p.company_id = manager_company_id
    ORDER BY pd.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate/reject receipts
CREATE OR REPLACE FUNCTION validate_receipt(
    receipt_id UUID,
    manager_id UUID,
    action TEXT, -- 'validate' or 'reject'
    reason TEXT DEFAULT NULL,
    validated_data JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF action = 'validate' THEN
        UPDATE project_documents 
        SET 
            validation_status = 'validated',
            validated_by = manager_id,
            validated_at = NOW(),
            validation_metadata = validated_data
        WHERE id = receipt_id;
        
        result = json_build_object('success', true, 'action', 'validated');
    ELSIF action = 'reject' THEN
        UPDATE project_documents 
        SET 
            validation_status = 'rejected',
            validated_by = manager_id,
            validated_at = NOW(),
            rejection_reason = reason
        WHERE id = receipt_id;
        
        result = json_build_object('success', true, 'action', 'rejected');
    ELSE
        result = json_build_object('success', false, 'error', 'Invalid action');
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_pending_invoice_validations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_receipt(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- Create notification trigger for new receipts
CREATE OR REPLACE FUNCTION notify_new_receipt_submission()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify for receipt documents
    IF NEW.document_type = 'receipt' AND NEW.validation_status = 'submitted' THEN
        -- Here you could add notification logic (e.g., insert into notifications table)
        -- For now, we'll just ensure the status is set correctly
        NEW.validation_status = 'submitted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_new_receipt_notification ON project_documents;
CREATE TRIGGER trigger_new_receipt_notification
    BEFORE INSERT ON project_documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_receipt_submission();

-- Add policy for managers to see all pending receipts in their company
CREATE POLICY "Managers can view pending receipts in their company" ON project_documents
    FOR SELECT 
    USING (
        document_type = 'receipt' 
        AND validation_status IN ('submitted', 'pending')
        AND EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_documents.project_id 
            AND p.company_id = (
                SELECT company_id FROM user_profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Add policy for managers to update receipt validation status
CREATE POLICY "Managers can validate receipts in their company" ON project_documents
    FOR UPDATE 
    USING (
        document_type = 'receipt'
        AND EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_documents.project_id 
            AND p.company_id = (
                SELECT company_id FROM user_profiles 
                WHERE id = auth.uid()
            )
        )
    );