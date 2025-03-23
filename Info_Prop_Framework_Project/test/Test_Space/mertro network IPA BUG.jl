mertro network IPA BUG 

When additional edges are discovered through handle_additional_nodes!, we find important connections (like 14 → 98) that reveal a more extensive diamond structure. However, the current implementation doesn't update the ancestor_group.ancestors set to include these new ancestors (node 14).
Since 14 is not in the ancestor set but appears as a source for a diamond node, the diamond structure is incorrectly captured.